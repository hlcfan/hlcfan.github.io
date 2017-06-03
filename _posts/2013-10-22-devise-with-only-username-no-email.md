---
layout: post
title: 'Devise with only username no email'
date: 2013-10-22 06:32
comments: true
categories: tech
---
There is the wiki of Devise [Allow users to sign in using their username or email address](https://github.com/plataformatec/devise/wiki/How-To:-Allow-users-to-sign-in-using-their-username-or-email-address "Allow users to sign in using their username or email address")

but now we dont need email, only username.
#### User.rb
``` ruby
attr_accessible :login, :username
attr_accessor :login

def self.find_first_by_auth_conditions(warden_conditions)
	conditions = warden_conditions.dup
	puts "Conditaions: #{conditions}"
	if login = conditions.delete(:login)
	  where(conditions).where(["lower(username) = :value", { :value => login.downcase }]).first
	else
	  where(conditions).first
	end
end

# the 2 methods are very important in Rails 4 and Devise 3.1.0
def email_required?
	false
end

def email_changed?
  false
end
```

#### /config/initializers/devise.rb
``` ruby
config.authentication_keys = [ :login ]
```

