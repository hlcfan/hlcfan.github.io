---
layout: post
title: 'to_s VS to_str'
date: 2015-01-13 11:12
comments: true
categories: tech
---
Today, one ofmy colleagues talked about `to_s` and `to_str`. He didn't make it clear. Let me show you a simple example:

``` ruby
class Integer
  def to_str
    'it behaves like a string'
  end
end
puts '9' + 1

> 9it behaves like a string
```

