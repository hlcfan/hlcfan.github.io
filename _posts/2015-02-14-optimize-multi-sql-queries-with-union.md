---
layout: post
title: 'Optimize multi sql queries with union'
date: 2015-02-14 05:33
comments: true
categories: tech
---
Saw some code in our project:

``` ruby
ordered_list = %w{Python Ruby Go Erlang C# C++ Objective-C Swift Java Elixir R Javascript Haskell SmallTask Lisp}
 
ordered_list.map do |name|
  Lang.where(name: name).first
end.compact
```

Which leads to too many queries to Database. Simply we can optimize this by `union` or `union all`

``` ruby
ordered_list = %w{Python Ruby Go Erlang C# C++ Objective-C Swift Java Elixir R Javascript Haskell SmallTask Lisp}
 
sql = ordered_list.map do |name|
  "(#{Lang.where(name: name).limit(1).to_sql})"
end.join(' union all ')

find_by_sql sql
```

The reason here we dont hardcoded the query string like
``` sql
"select * from langs where name = '#{name}' limit 1"
```
is because `to_sql` could generates different query strings depends on your database, say MySQL, Oracle.

Also I found `langs` table doesn't have an index on name column, so
`bundle exec rake g migration add_index_to_langs`

``` ruby
class AddIndexToLangs < ActiveRecord::Migration
  def change
    add_index :langs, :name, unique: true
  end
end
```

`bundle exec rake db:migrate`

Well, tested with Benchmark, much faster than before, about 10 times.

You may be curious why use `union all` instead of `union`, let me tell the differences:

+ `union` will remove the duplicate record which absolutely cost a little bit performance.
+ `union all` on the contrary, won't compress the results.

In the code above we already called a `limit` on the query, so no need to compress the results.

References:
+ [Using UNION to implement loose index scan in MySQL](http://www.percona.com/blog/2006/08/10/using-union-to-implement-loose-index-scan-to-mysql/)
