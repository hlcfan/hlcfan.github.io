---
layout: post
title: 'Set Up Solr With Ruby on Rails'
date: 2013-09-15 07:55
comments: true
categories: tech
---
Solr is a full text search engine based on Lucence of high performance.the advantages of solr is you dont need to set up the complex lucence directly and solr is more powerful.

you could get the search result via HTTP protocol which seems easy,but whats more easier is you could use it within Rails just with 2 gems.
### Add Gems
``` ruby
gem 'sunspot_rails'
group :development do
	gem 'sunspot_solr'
end
```
then `bundle install`
after install, generate the configuration file
`rails generate sunspot_rails:install`
