---
layout: post
title: Migrate from MySQL to PostgreSQL for existing Rails project
date: 2017-10-06 20:26
comments: true
categories: tech
---

Pokrex was using MySQL, in order to support emoji, I have to switch from `utf8` to `utf8mb4` encoding. It's tricky, because
+ There will be different encoding for each table and each column
+ Have to modify index length
+ Travis keep raising "767 bytes length error"

Therefore, I gave up and decided to switch to PostgreSQL.

### Replace MySQL adapter `mysql2` with `pg`
``` ruby
gem 'pg'
```

### Update schema file
#### Update `database.yml` to connect to new PostgreSQL database
``` yml
development: &default_settings
  adapter: postgresql
  host: localhost
  database: database_name
  username: username
  password: password
  encoding: unicode
```

#### Re-run db migration
+ Remove MySQL related options from `schema.rb` `options: "ENGINE=InnoDB DEFAULT CHARSET=utf8"`
+ Run `./bin/rails db:migrate`

Hence, `schema.rb` will be updated accordingly.

### Update travis.yml
[https://docs.travis-ci.com/user/database-setup/#PostgreSQL](https://docs.travis-ci.com/user/database-setup/#PostgreSQL)

```
services:
  - postgresql

...

before_script:
  - psql -c 'create database travis_ci_test;' -U postgres
```

### Load data from MySQL to PostgreSQL
+ Backup MySQL database
```
mysqldump -u username -p database_name > database_name.sql
```
+ Install [pgloader](https://github.com/dimitri/pgloader) (>= 3.4.1)
+ Create command file migration.load
```
LOAD DATABASE
  FROM mysql://user:pass@localhost/database_name
  INTO postgresql://user:pass/database_name

ALTER SCHEMA 'database_name' RENAME TO 'public';
```

+ Run pgloader
```
pgloader -v -L ./migration.log migration.load
```

Bingo, you're now successfully migrated from MySQL to PostgreSQL.