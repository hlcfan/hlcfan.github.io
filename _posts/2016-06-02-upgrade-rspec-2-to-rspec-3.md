---
layout: post
title: 'Upgrade Rspec 2 to Rspec 3'
date: 2016-06-02 07:15
comments: true
categories: tech
---
FYI: This is a very detailed information about upgrading from Rspec 2 to Rspec 3.

We're using Rspec as our test framework in application. For now it's Rspec 2, considering we'll upgrade Rails to 4 later, I decide to upgrade Rspec first.

After I've finished the upgrade, it seems quite easy. Bump the version, fix old syntax. Actually it's not. It traps me several times, I'm putting it here, other guys can refer to. I didn't quite follow the [official guide](http://rspec.info/upgrading-from-rspec-2/). Instead, I directly go to 3 from 2.

## Precedures:
### Update Gemfile

Update `rspec-rails` gem to `3.0.0`
``` ruby
gem "rspec-rails", "~> 3.0.0"
```

Then if you try to run `bundle` to update `Gemfile.lock`, you'll find dependency conflicts
```
Bundler could not find compatible versions for gem "rspec-mocks":
  In snapshot (Gemfile.lock):
    rspec-mocks (= 2.14.4)

  In Gemfile:
    json_spec was resolved to 1.1.4, which depends on
      rspec (< 4.0, >= 2.0) was resolved to 2.14.1, which depends on
        rspec-mocks (~> 2.14.0)

    rspec-rails (~> 3.0.0) was resolved to 3.0.0, which depends on
      rspec-mocks (~> 3.0.0)

Running `bundle update` will rebuild your snapshot from scratch, using only
the gems in your Gemfile, which may resolve the conflict.
```

From the error message, we can tell that `rspec-mocks` in `Gemfile.lock` is lock to `2.14.4` and `rspec` is locked to `2.14.0`. So, we need to manually update `Gemfile.lock`, like:

```
...
rspec (3.0.0)
rspec-core (~> 3.0.0)
rspec-expectations (~> 3.0.0)
rspec-mocks (~> 3.0.0)
rspec-support (~> 3.0.0)
rspec-core (3.0.4)
rspec-expectations (3.0.4)
diff-lcs (>= 1.1.3, < 2.0)
nokogiri (>= 1.4.4)
rspec (>= 2.0.0)
rspec-mocks (3.0.4)
...
```
You may ask why it's `3.0.4`, cuz I have version `3.0.4` installed on my laptop, you may change it to yours by finding your version number `gem list | grep rspec-core`.etc.

After manually updated, run `bundle` again. Yes! newer Gems are ready to work! 

### Update `spec_helper.rb` to `rails_helper.rb`

Default helper files created in RSpec 3.x have changed, [see](https://relishapp.com/rspec/rspec-rails/docs/upgrade#default-helper-files). Generators run in RSpec 3.x will require rails_helper and not spec_helper. 

What we need to do is quite simple, just rename `spec_helper.rb` to `rails_helper.rb` and do a global repalcement. I use Sublime, just *global replace* and *save all* will do the work.

Pheww, for now, we've done all the infrastructure job. Let's run the specs
```
bundle exec rspec
```

Don't get optimistic, let's see the errors:

1. undefined method `color_enabled='
```
path_to_spec/rails_helper.rb:151:in `block in rspec_defaults': undefined method `color_enabled=' for #<RSpec::Core::Configuration:0x007f9f71d5afd0> (NoMethodError)
```

It's because that `color_enabled=` was deprecated, it's using `config.color=` now, let's just change it to `config.color = true`.

2. undefined method `its'
```
path_to_spec.rb:10:in `block (3 levels) in <top (required)>': undefined method `its' for #<Class:0x007fc68bc71ba0> (NoMethodError)
```

This is because [its isn't core to RSpec](https://gist.github.com/myronmarston/4503509) and [Arguments passed to its ](https://github.com/rspec/rspec-core/pull/306#issuecomment-758989). You can change to use [One-liner syntax](https://www.relishapp.com/rspec/rspec-core/docs/subject/one-liner-syntax) `it { is_expected.to be_empty }` or simply add in `gem 'rspec-its'` to your Gemfile.

3 undefined local variable or method `login_admin' for RSpec::ExampleGroups::NotificationsController:Class (NameError)

This is because [File-type inference disabled by default](https://relishapp.com/rspec/rspec-rails/docs/upgrade#file-type-inference-disabled). Previously we automatically inferred spec type from a file location, this
was a surprising behaviour for new users and undesirable for some veteran users
so from RSpec 3 onwards this behaviour must be explicitly opted into with:
```
RSpec.configure do |config|
  config.infer_spec_type_from_file_location!
end
```

You can either add code above into `rails_helper.rb` or specify type in controller test like `describe NotificationsController, :type => :controller do`.

4. Using `any_instance` to stub a method (some_method) that has been defined on a prepended module (SOmeModule) is not supported.

This is Rspec's bug, [see](https://github.com/rspec/rspec-mocks/issues/781). Man, looks we need to upgrade to 3.1.0 then. So update `Gemfile` and `Gemfile.lock` again to `3.2.0`. Don't ask me why 3.2.0 :>

5. NoMethodError: undefined method `visit' for #<RSpec::ExampleGroups

This is because we havent include `Capybara::DSL` in your Rspec configuration. I don't know how it works before...Weird. Add `config.include Capybara::DSL` in `RSpec.configure` block.

6. expected true to respond to `true?`

Rspec had deprecated `be_true` and `be_false`, instead they use `be_truthy` and `be_falsey` or `be_falsy`. Meanwhile, I found that we're mis-using `be_true` sometimes. Most of time, we want `be true` instead of `be_true`. See

``` ruby
expect(actual).to be_truthy   # passes if actual is truthy (not nil or false)
expect(actual).to be true     # passes if actual == true
expect(actual).to be_falsy    # passes if actual is falsy (nil or false)
expect(actual).to be false    # passes if actual == false
expect(actual).to be_nil      # passes if actual is nil
expect(actual).to_not be_nil  # passes if actual is not nil
```

7. ArgumentError: wrong number of arguments (0 for 1+)

This isn't a very explicit error message. The whole message is 
```
Failure/Error: Model.stub(:find_by_key).and_return { FactoryGirl.create(:model) }
```
If you look at the code, you'll find that it's actually not from the upgrade, but the code synatx. Stub should either return a value or a block. But from the code above, it actually calls both `and_return` and `{}`(block).

8. MethodError: undefined method `have' for #<RSpec::ExampleGroups::User::FactoryGirl::User:0x007fbce621dcc0>

This is because `rspec-collection_matchers` was split out. Simple add it to Gemfile `gem 'rspec-collection_matchers'` and require it in `rails_helper.rb`, `require 'rspec/collection_matchers'`.

9. RSpec::Matchers::NokogiriMatcher implements a legacy RSpec matcher
protocol. For the current protocol you should expose the failure messages
via the `failure_message` and `failure_message_when_negated` methods.
(Used from path_to_gems/rspec-html-matchers-0.3.5/lib/rspec-html-matchers.rb:249:in `with_tag')

Seems it's a warning, let's fix it by upgrade `rspec-html-matchers` to latest `0.7.3`.

10. rspec-html-matcher does not match text explicitly by text only.

You may not understand the title, lemme put it this way:

You have a template:
``` html
<p>
  some text
</p>
```

You have test:
```
expect(html).to have_tag('section', text: 'some text')
```

If you run it, it will not pass. Wut?!! 
This is because the actual text rendered in template will be something like 
```
\n  some text\n
```
As you can see, indeed it doesn't equals `some text`.

Then if you look into the source of `rspec-html-matcher`, you'll find this commit https://github.com/kucaahbe/rspec-html-matchers/commit/43143d9c896ea6bbc8a990756dd4d899262cc922, the author removed `node.content.strip.squeeze(' ')`, thus this test fails. So now, you need to use Regex if you wanna match a text in a structured html.
```
expect(html).to have_tag('section', text: /some text/)
```

10. Deprecation warnings.

After all these done, all my tests pass, there're many deprecation warnings. I found a very usefull tool `transpec` https://github.com/yujinakayama/transpec. Install it `gem install transpec` and run the command under your app directory `transpec`, it'll automatically update the old syntax to new ones. Easy and powerful. See the conversions https://github.com/yujinakayama/transpec#conversions-enabled-by-default

After ran `traspec`, there's still 2 warnings:
```
`failure_message_for_should_not` is deprecated. Use `failure_message_when_negated` instead. Called from path_to_gem/cancan-1.6.5/lib/cancan/matchers.rb:11:in `block in <top (required)>'.

`failure_message_for_should` is deprecated. Use `failure_message` instead. Called from path_to_gem/cancan-1.6.5/lib/cancan/matchers.rb:7:in `block in <top (required)>'.
```

This is because the method cancan uses is deprecated, we just override the method in `rails_helper.rb` and remove its requirement `require "cancan/matchers"`

``` ruby 
  # Custom Cancan matchers, reason:
  # `failure_message_for_should_not` is deprecated.
  # Use `failure_message_when_negated` instead.
  # `failure_message_for_should` is deprecated.
  # Use `failure_message` instead.
  RSpec::Matchers.define :be_able_to do |*args|
    match do |ability|
      ability.can?(*args)
    end

    failure_message do |ability|
      "expected to be able to #{args.map(&:inspect).join(" ")}"
    end

    failure_message_when_negated do |ability|
      "expected not to be able to #{args.map(&:inspect).join(" ")}"
    end
  end
```
## Recap
Alright, been along with upgrading Rspec, there're a lot to learn.

+ How `Gemfile` and `Gemfile.lock` work.
+ What new syntax or new APIs Rspec 3 uses.
+ Which gem was removed from Rspec 3 and what's its name.
+ What made of Rspec.
+ Knows how rspec-html-matcher works.
+ `be_true` != `be true`, vice versa.
+ Cancan out of maintainance, community prefers `cancancan`, LOL.


## References:
+ http://rspec.info/blog/2014/05/notable-changes-in-rspec-3/
+ http://rspec.info/upgrading-from-rspec-2/
+ https://relishapp.com/rspec/rspec-rails/docs/upgrade