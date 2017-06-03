---
layout: post
title: 'Rails app with multiple domains'
date: 2016-02-20 10:04
comments: true
categories: tech
---
We had recently released a story, which allow one app to serve with 2 domains. I'm writing the details down if other guys need some references. Note, in our case, there're 2 domains, this solution could also work with more than 2 domains.

I'll start with two perspectives, Route and Business logic.

## Route
### We have `hosts.yml` file with domains/hosts configured in it.

``` ruby
development: &development
  site_1: site1.dev
  site_2: site2.dev

staging:
...

production:
  site_1: www.site1.com
  site_2: www.site2.com
```

### Load this config file while app starting, you can put this file into `initializers` directory, `hosts.rb`

``` ruby
HOSTS_CONFIG = ConfigLoader.load_yml_config('config/hosts.yml', Rails.env)
puts "Site 1 Domain: #{DOMAINS_CONFIG[:site_1]}"
puts "Site 2 Domain: #{DOMAINS_CONFIG[:site_2]}"
```

### Detect request host in Routes

1. Define a custom constraint class in lib/domain_constraint.rb:

``` ruby
class Site1HostConstraint
  def matches?
    HOSTS_CONFIG[:site_1] == request.host
  end
end
```

2. Use the class in your routes with the new block syntax

``` ruby
constraints Site1HostConstraint.new do
  root :to => "site_1#index"
end

root :to => 'main#index'
```

## Business Logic
In order to know the current request host across the whole app, mainly including Model and View/Presenter layers. There's one way you can pass the `request.host` via controller, but I think it's sorta complex if we pass in that object everywhere. Thus I introduced a gem called [request_store](https://github.com/steveklabnik/request_store), this gem allows global variable in Rails.

### Set current request host in ApplicationController

1. Add before filter

``` ruby
before_filter :set_request_host

private

def set_request_host
  RequestStore.store[:host] = request.host
end
```

2. Access current request host globally

``` ruby
module HostHelper
  def self.host_name
    RequestStore.store[:host]
  end
end
```
Then, you can do something like `HostHelper.host_name` in Model layer or Presenter layer. Also you can define methods like `.site_1?` `.site_2?`.etc.

## Recap
By using Rails Route Constraint, you can decide which controller to go according to the request host.
With Gem `request_store`, you can determine which is the current request host across whole app.
I'll come up with more about Cookie share between domains in my next post.

## References:
+ http://stackoverflow.com/questions/4207657/rails-routing-to-handle-multiple-domains-on-single-application
+ http://guides.rubyonrails.org/routing.html#advanced-constraints