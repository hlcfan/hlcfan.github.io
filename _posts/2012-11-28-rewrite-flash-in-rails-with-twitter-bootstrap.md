---
layout: post
title: 'Rewrite flash in Rails with twitter bootstrap'
date: 2012-11-28 16:22
comments: true
categories: tech
---


## Here We Go

### Prerequisite
u'v got bootstrap javascript and stylesheets in ur rails app.

### Then
1.rewrite flash container in `application.html.erb` like this:
``` html
<div id ="flash_container" class="noPrint">
<%=render :partial => "shared/flash_messages", :locals => {:flash => flash} %>
</div>
```

2.add a file named `_flash_messages.html.erb` in `views/shared`,file content:
``` html
<% flash.each do |type, message|%>      
	<div data-alert="alert" class="alert <%= alert_type(type)%> fade in" >
		<a href="#" class="close" data-dismiss="alert">×</a>
		<%= message %>
	</div>
<% end %>
```

3.add a method in application helper
``` ruby
def alert_type(type)
    case type
      when :alert
        "alert-block"
      when :error
        "alert-error"
      when :notice
        "alert-info"
      when :success
        "alert-success"
      else
        type.to_s
    end
  end
```

4.then use it in ur actions
``` ruby
flash[:notice]
flash[:alert]
flash[:error]
blah......
```
