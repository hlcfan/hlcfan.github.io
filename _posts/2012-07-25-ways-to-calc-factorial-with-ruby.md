---
layout: post
title: 'Ways to calc factorial with ruby'
date: 2012-07-25 14:25
comments: true
categories: tech
---

Days ago,i got a problem about how to calc factorial

#### Way 1 --- the original way
``` ruby
def func(m)
	s = 1
	(1..m).each do |n|
		s *= n
	end
	s
end
```

#### Way 2 --- less way
``` ruby
def func(m)
	return 1 if m == 1
	m*func(m-1)
end
```

#### Way 3 --- ruby way
``` ruby
def func1(m)
	(1..m).inject {|s,i| s *= i}
end
```
Or
``` ruby
def func2(m)
	(1..m).inject :*
end
```
