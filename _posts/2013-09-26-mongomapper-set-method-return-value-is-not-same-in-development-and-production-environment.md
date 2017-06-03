---
layout: post
title: 'MongoMapper set method return value is not same in development and production environment'
date: 2013-09-26 12:22
comments: true
categories: tech
---
Yesterday,I was informed that there is a error in my Rails App,so I run `rails server` in development environment and found nothing,but error still exist on server.
Is the return value not the same in development and production environment?
Let's do a test!
`rails c development`
> Model.set({:id => ids}, :foo => bar)
=> 120  
 #Which class is Fixnum

`rails c production`
> Model.set({:id => ids}, :foo => bar)
=> {"updatedExisting"=>true, "n"=>2, "lastOp"=>seconds: 1380198531, increment: 48, "connectionId"=>117691, "err"=>nil, "ok"=>1.0}  
 #Which class is BSON::OrderedHash

with the return value, we could see the difference!i dont know why and didnt look into official documents.

