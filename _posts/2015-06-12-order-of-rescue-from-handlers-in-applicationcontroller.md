---
layout: post
title: 'Order of rescue_from handlers in ApplicationController'
date: 2015-06-12 07:21
comments: true
categories: tech
---
We have some code in `application_controller.rb` like
``` ruby
	unless Rails.application.config.consider_all_requests_local
    rescue_from ActiveRecord::RecordNotFound, with: :render_404
    rescue_from Exception, with: :render_500
  end
```

Generally, people would think when it throws an `Exception`, it will be first catched by the first handler `rescue_from ActionController::RoutingError, with: :render_404`, and deal with `render_404`. When I access `/posts/10`, which is a post that doesn't exist, it gives me 500 page instead of 404 as we expected. Weried, huh? 

Actually, thing doesn't go this way as we thought it was.

These handlers are evaluated from bottom to top meaning that your last defined handler will have the highest priority and your first defined handler will have the lowest priority. If you reverse them then you will get the behavior you want.(copy from SO)

Which means if you do
``` ruby
	unless Rails.application.config.consider_all_requests_local
    rescue_from Exception, with: :render_500
    rescue_from ActiveRecord::RecordNotFound, with: :render_404
  end
```
Things go the right way, it'll render 404 for you.

Let's have a look at `rescue_from`

`rescue_from` receives a series of exception classes or class names. Handlers are inherited. They are searched from right to left, from bottom to top, and up the hierarchy. The handler of the first class for which exception.is_a?(klass) holds true is the one invoked, if any. Here's the source of `rescue_from`:

``` ruby
# File activesupport/lib/active_support/rescuable.rb, line 51
def rescue_from(*klasses, &block)
  options = klasses.extract_options!

  unless options.has_key?(:with)
    if block_given?
      options[:with] = block
    else
      raise ArgumentError, "Need a handler. Supply an options hash that has a :with key as the last argument."
    end
  end

  klasses.each do |klass|
    key = if klass.is_a?(Class) && klass <= Exception
      klass.name
    elsif klass.is_a?(String)
      klass
    else
      raise ArgumentError, "#{klass} is neither an Exception nor a String"
    end

    # put the new handler at the end because the list is read in reverse
    self.rescue_handlers += [[key, options[:with]]]
  end
end
```

Note `self.rescue_handlers += [[key, options[:with]]]` and remember *They are searched from right to left, from bottom to top, and up the hierarchy.* so the last handler will be called firstly.

+ http://api.rubyonrails.org/classes/ActiveSupport/Rescuable/ClassMethods.html
+ http://stackoverflow.com/questions/9119066/how-do-i-determine-which-exception-handler-rescue-from-will-choose-in-rails