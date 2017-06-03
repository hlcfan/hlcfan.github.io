---
layout: post
title: 'Keep it simple, stupid'
date: 2016-09-03 01:52
comments: true
categories: tech
---
We both know that [KISS](https://en.wikipedia.org/wiki/KISS_principle) principle, along with the time we're working. Recent months, I have more in-depth  recognition about it. I would like to show a few examples to elaborate more via different aspects.

### Writing tests

Say, if we want to test a  method in presenter layer, it's purpose is to truncate an article title, that could be too long as title.

``` ruby
def render_truncated_title
  # template is an instance of ActionView::Base
  template.truncate title, length: 24, separator: ''
end
```

People would write the test like:

``` ruby
let(:article) { Article.new(title: "It works great for titles longer than 24 characters.") }
let(:article_presenter) { ArticlePresenter.new(article) }

it "truncates article title if title is more than 24 letters" do
  expect(article_presenter.render_truncated_title).to eq "It works great for title..."
end
```

Ok, looking at the test. hmm, everything looks fine, nothing goes wrong. Yes, it is. But somehow we can focus more on testing the method `render_truncated_title` instead of creating an article object and stubbing some fields. Under the hood, we don't care about the article object at all. So let's try to remove it.

``` ruby
it "truncates article title if title is more than 24 letters" do
  article = double(title: "It works great for titles longer than 24 characters.")
  article_presenter = ArticlePresenter.new(article)
  expect(article_presenter.render_truncated_title).to eq "It works great for title..."
end
```

In the example, I remove the creation of `Article` object, but put `let` into `it` block. The latter one is just one style.

Wait, look at the source of that method `render_truncated_title`, do we really need to create a `ActionView::Base` object? What we need is the method `truncate` is all. Let's get rid of it:

``` ruby
include ActionView::Helpers::TextHelper

def render_truncated_title
  truncate title, length: 24, separator: ''
end
```

See? Is it much more simple and stupid? For many of the cases, we can simplify the situation.

### Wrong abstraction

You has following code to render foot ads, from which we can know that 

Say, you'll need to render foot ads on each article. Most of the articles will just render two ads, left and right. 

``` ruby
def render_foot_ads
  %w(left right).map do |position|
    render_ad "foot_#{position}"
  end.join.html_safe
end
```

But then, products says that, for one or two articles, it needs to render ads with different positions according to article id passes into. I guess you'll need to render different ads according to whether it passes in an aticle id.

``` ruby
def render_foot_ads suffix = nil
  %w(left right).map do |position|
    render_ad "foot_#{position}" + ("_#{suffix}" if suffix.present?).to_s
  end.join.html_safe
end
```

It definitely looks ugly, probably we can extract some logic out?

``` ruby
def render_foot_ads suffix = nil
  %w(left right).map do |position|
    render_ad "foot_#{position}#{foot_ads_sufix(suffix)}"
  end.join.html_safe
end

def foot_ads_sufix suffix = nil
  "_#{suffix}" if suffix.present?
end
```

So far, it looks not that bad and it works. 

Now, let's thinking about it. Since just one or two articles need to render ads with different positions according to article id. For most of the articles, it does not need a position `suffix` to render the ads. Why do we absctract the method for those few articles? I would quote [Sandi Metz's](http://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction)

> Prefer duplication over the wrong abstraction

Apparently, it's a wrong abstraction situation. Let's decouple it.

For most cases, it needs to render two ads

``` ruby
def render_foot_ads
  capture do
    concat render_ad("foot_left")
    concat render_ad("foot_right")
  end
end
```

And for few cases, it needs to render according to article id

``` erb
render_ad "foot_left_#{article_id}"
render_ad "foot_right_#{article_id}"
```

Whow, that looks neat.

### Over-engineering

As for this section, I dont have any code sample, but it happens in one of my projects tho. After that, I would tell meself, stop over-engineering next time. It just costs too much, may lead to effort to maintain and less understandable code.

There're two kinds of over-engineering, one is same effect/purpose as before. You just switch to complex way to deal with it, this is the worst.

The other one is too much design, at least this kind of over-engineering makes people think more. You gotta leverage is it worthy doing. If your system wont change in the future, then don't. Otherwise, your system probably change in short time, you should do it, it's design. 😜

Software engineering tells us do not do big upfront design. if you can do it simple, dont do it complex. 

### Recap

I advocte to have more thinking while writing code and try not to cutting corners. When you have some logic seems to be werid, stop and think. You may come up with a better solution.😉