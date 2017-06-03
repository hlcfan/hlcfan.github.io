---
layout: post
title: 'Float(fixed) panel while scroll in web page'
date: 2013-02-28 14:00
comments: true
categories: tech
---

We could see too many sites which has float fixed panel in web page.
such as:

+ the share button and next button in [thenextweb](http://thenextweb.com/insider/2013/02/28/bitcoin-virtual-currency-stages-epic-comeback-hits-new-all-time-high-of-32/)
+ the navigate and share button on the top in [LINKCHIC](http://www.linkchic.com/)

Of course,if u want the panel to stay,u should set the css **position** to **fixed**

#### First we need a JS function
``` javascript
function stay_there(){
	h = $(document).scrollTop();
	(h > 178) ? $('.operate_zone').css('position','fixed').css('top',40) : $('.operate_zone').css('position','relative').css('top',0);
}
```
#### Then,we need it to work.
``` javascript
$(document).ready( function($) {
	stay_there();
}
```
#### Done!



