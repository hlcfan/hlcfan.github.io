---
layout: post
title: Find nearby locations in Rails with Oracle
date: 2018-08-29 13:39
comments: true
categories: tech
---

### Background
We have feature that shows the nearby 20 cities by given city. From the outset, everything goes fine, the query takes some milliseconds to run. With time passing by, we have thousands of cities, not that many, right? However, we haven't noticed the issue until some day I wander NewRelic transations.
![new-relic-db-time-costs](/assets/images/2018-08-28-new-relic-query.png){:class="img-responsive"}

Holy cow, how could a query costs so much, like ~150ms, that's acceptable load time of a webiste. Let's take a look at the SQL.

``` sql
SELECT * FROM (
  SELECT SDO_GEOM.SDO_DISTANCE(
    SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(-122.46102,37.874089,NULL),NULL,NULL),
    SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(lng,lat,NULL),NULL,NULL),
    0.0001,
    'unit=MILE'
  ) AS DISTANCE, "LOCATIONS"."ID"
  FROM "LOCATIONS" 
  WHERE (id != 1) ORDER BY distance asc) WHERE ROWNUM <= 20
```

Let's run an explain plan for this:
![explain-plan-not-optimized](/assets/images/2018-08-28-explan-plan-not-optimized.png)

OK, it scans whole table and use `SDO_GEOM.SDO_DISTANCE` to calculate the distance from given city latitude and longitude. This is not good practise. What if we have more and more cities, it'll costs more time while scanning whole table.

### SDO_NN come to the rescue
[sdo_nn](https://docs.oracle.com/database/121/SPATL/sdo_nn.htm), as it describes, uses the spatial index to identify the nearest neighbors for a geometry. Exactly what we want.

In order to use this function, we'll need a geometry column, let's add one.
Before we write code, keep in mind the basic steps are:
+ Add a geometry column
+ Populate the geometry column with latitude and longitude
+ Update USER_SDO_GEOM_METADATA view
+ Create sptial index

#### DB migration
``` 
rails g migration add_geometry_to_locations
```

``` ruby
def up
  execute <<-SQL
    -- Add a spatial geometry column.
    ALTER TABLE locations ADD (shape SDO_GEOMETRY)
  SQL

  execute <<-SQL
    -- Update the table to populate geometry objects using existing
    -- latutide and longitude coordinates.
    UPDATE locations SET shape =
      SDO_GEOMETRY(
        2001,
        8307,
        SDO_POINT_TYPE(LNG, LAT, NULL),
        NULL,
        NULL
      )
  SQL

  execute <<-SQL
    -- Update the USER_SDO_GEOM_METADATA view. This is required
    -- before the spatial index can be created.
    declare
    begin
      INSERT INTO user_sdo_geom_metadata VALUES (
        'locations',
        'SHAPE',
        SDO_DIM_ARRAY(
          SDO_DIM_ELEMENT('LNG',-180,180,0.5),
          SDO_DIM_ELEMENT('LAT',-90,90,0.5)
        ), 8307);
    exception
       when OTHERS then
         dbms_output.put_line('user_sdo_geom_metadata view already exists');
    end;
  SQL

  execute <<-SQL
    -- Create the spatial index.
    CREATE INDEX locations_spatial_idx on locations(shape) 
      INDEXTYPE IS MDSYS.SPATIAL_INDEX
  SQL
end

def down
  execute <<-SQL
    -- Remove spatial index
    DROP INDEX locations_spatial_idx
  SQL

  execute <<-SQL
    -- Remove view
    DELETE FROM user_sdo_geom_metadata WHERE TABLE_NAME='LOCATIONS'
  SQL

  execute <<-SQL
    -- Remove geometry column
    ALTER TABLE locations DROP COLUMN shape
  SQL
end
```

Phew, a lot of lines. Luckily, we have comments. Run DB migration:
``` 
rails db:migrate
```

#### Rewrite the query
Rewrite the query with new column.

``` sql
SELECT sdo_nn_distance(1) distance, LOCATIONS.ID
FROM LOCATIONS
WHERE (id != 13487) AND (
  SDO_NN(
    locations.shape, SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(-106.828651,39.655263,NULL),NULL,NULL),
    'SDO_NUM_RES=20 UNIT=mile',
    1) = 'TRUE'
  ) ORDER BY distance
```

Bam! It works. Let's update the ruby code.

Existing code:
``` ruby
Location.where("id != ?", id)
        .select("SDO_GEOM.SDO_DISTANCE(
                  SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(#{connection.quote(lng)},#{connection.quote(lat)},NULL),NULL,NULL),
                  SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(lng,lat,NULL),NULL,NULL),
                  0.0001,
                  'unit=MILE'
                ) AS DISTANCE")
        .order("distance")
        .limit(20)
        .pluck(:id)
```

Updated code:
``` ruby
Location.where("id != ?", id)
        .where("SDO_NN(
          locations.shape,
          SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(#{connection.quote(lng)},#{connection.quote(lat)},NULL),NULL,NULL),
          'SDO_NUM_RES=20 UNIT=mile',
          1
        ) = 'TRUE'")
        .select("sdo_nn_distance(1) distance")
        .order("distance")
        .pluck(:id)
```

### Performance

Is using spatial index more performant? Run an explain plan:

![explain-plan-optimized](/assets/images/2018-08-28-explan-plan-optimized.png)

Wow, such improvement. Let's run a benchmark:
``` sql
SET SERVEROUTPUT ON
DECLARE
  v_ts TIMESTAMP WITH TIME ZONE;
  v_repeat CONSTANT NUMBER := 100;
BEGIN

  -- Repeat the whole benchmark several times to avoid warmup penalty
  FOR r IN 1..5 LOOP
    v_ts := SYSTIMESTAMP;

    FOR i IN 1..v_repeat LOOP
      FOR rec IN (
        SELECT * FROM (SELECT SDO_GEOM.SDO_DISTANCE(SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(-122.46102,37.874089,NULL),NULL,NULL),SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(lng,lat,NULL),NULL,NULL),0.0001,'unit=MILE') AS DISTANCE, "LOCATIONS"."ID" FROM "LOCATIONS"  WHERE (id != 10806) ORDER BY distance asc) WHERE ROWNUM <= 20
      ) LOOP
        NULL;
      END LOOP;
    END LOOP;

    dbms_output.put_line('Run ' || r ||', Statement 1 : ' || (SYSTIMESTAMP - v_ts));
    v_ts := SYSTIMESTAMP;

    FOR i IN 1..v_repeat LOOP
      FOR rec IN (
        -- Paste statement 2 here
        SELECT sdo_nn_distance(1) distance, LOCATIONS.ID FROM LOCATIONS WHERE (id != 13487) AND (SDO_NN(locations.shape, SDO_GEOMETRY(2001,8307,SDO_POINT_TYPE(-106.828651,39.655263,NULL),NULL,NULL), 'SDO_NUM_RES=20 UNIT=mile', 1) = 'TRUE') ORDER BY distance

      ) LOOP
        NULL;
      END LOOP;
    END LOOP;

    dbms_output.put_line('Run ' || r ||', Statement 2 : ' || (SYSTIMESTAMP - v_ts));
    dbms_output.put_line('');
  END LOOP;
END;
/
```

It runs each query for 100 times and sum up the time, then output it. See result:
```
Run 1, Statement 1 : +000000000 00:01:07.131165000
Run 1, Statement 2 : +000000000 00:00:01.061129000

Run 2, Statement 1 : +000000000 00:00:53.126662000
Run 2, Statement 2 : +000000000 00:00:01.189682000

Run 3, Statement 1 : +000000000 00:00:50.954898000
Run 3, Statement 2 : +000000000 00:00:00.974744000

Run 4, Statement 1 : +000000000 00:00:50.348152000
Run 4, Statement 2 : +000000000 00:00:00.950044000

Run 5, Statement 1 : +000000000 00:00:51.810915000
Run 5, Statement 2 : +000000000 00:00:01.000146000
```

Whereby the query we rewrite, it's almost 50x faster than former one. It's big win.

### Recap

The crux is rewrite `SDO_GEOM.SDO_DISTANCE` with `SDO_NN`. By utilizing the spatial index, we now only need to scan two rows and much less data processed. There're many functions that can query spatial index, see [https://docs.oracle.com/cd/E11882_01/appdev.112/e11830/sdo_index_query.htm](https://docs.oracle.com/cd/E11882_01/appdev.112/e11830/sdo_index_query.htm), remember to browse its documentations anytime if you'll need to do spatial query.