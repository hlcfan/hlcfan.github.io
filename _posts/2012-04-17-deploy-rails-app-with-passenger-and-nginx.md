---
layout: post
title: 'Deploy Rails App With Passenger & Nginx'
date: 2012-04-17 20:51
comments: true
categories: tech
---

Hi,Guys.for some reason i have to deploy my app on *nix OS.
OK,lets get it started.

### Install Passenger

1.install Passenger
``` bash
$ gem install passenger
```
2.after installed that,install passenger module for nginx
``` bash
$ rvmsudo passenger-install-nginx-module
```
next maybe you will keep hitting enter.of course,u could custom it by yourself.

OK,now passenger has been installed successfully.

### Pre-Job Before Deploy

Before Deploy,U need to do something:

* precompile ur assets:
``` bash
rake assets:precompile
```

* bundle install => "this could solve the prob:'XXXX is not checked out. Please run `bundle install` (Bundler::GitError)'"
``` bash 
bundle install --deployment 
```

### Deploy

> It is a good suggestion that do not run a server with super user.
> Shi Yan, Just Kidding

####Run Passenger with "Integrated Mode"

config the nginx.conf file,mostly in `/opt/nginx/conf/nginx.conf`
###### Some Important Points:
```
user  someuser;
gzip  on;
listen       80;
server_name  106.187.94.74;
root /XXXXX/Rails_App/public;   =>  **Must Point To Public Folder In Your APP**
passenger_enabled on;
```
uncomment this:
```
	#location / {
	#     root   html;
	#     index  index.html index.htm;
	#}
```

#### Run Passenger with "StandAlone Mode"

``` bash
rvmsudo passenger start -p 80 -e production --max-pool-size 100 --min-instances 3 --spawn-method smart --user=someuser
```


