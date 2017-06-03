---
layout: post
title: 'try method in Rails'
date: 2014-10-24 05:15
comments: true
categories: tech
---
Just a nip about `try` method in Rails

#### Rules
+ It’s a bad smell to chain try methods.
+ Do not use try if you have to.
+ (Rails 3)Doesn’t return nil if the object you try from isn’t nil.
+ (Rails 4)It DOES return nil, even if the object you try from isn’t nil.

#### Source
Rails 3
``` ruby
# File activesupport/lib/active_support/core_ext/object/try.rb, line 32
def try(*a, &b)
  if a.empty? && block_given?
    yield self
  else
    __send__(*a, &b)
  end
end
```

Rails 4
``` ruby
# File activesupport/lib/active_support/core_ext/object/try.rb, line 41
def try(*a, &b)
  if a.empty? && block_given?
    yield self
  else
    public_send(*a, &b) if respond_to?(a.first)
  end
end
```
 
We can tell from the source that in Rails 4, there aint error.