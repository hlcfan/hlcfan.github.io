---
layout: post
title: 'How to organize css files for responsive design'
date: 2015-06-12 06:50
comments: true
categories: tech
---
Recently I'm doing some font-end stuff, mostly about CSS.

In your existing app, people organize the CSS files, like 

  - app/
    - posts.css.less
    - editors.css.less
    - books.css.less
  - mobile/
    - posts.css.less
    - editors.css.less
    - books.css.less
  - application.css
  
As you can see, we split the styles for desktop and mobile(which contains tablet). The styles for desktop are placed in `app` folder, the styles for mobile are put in `mobile` folder. At the very beginning, I think that's the right way to organize the CSS files. Until days ago, I realise that's the bad way.

The disadvantages of split styles into 2 folders:
+ You have to maintain 2 CSS files for both desktop and mobile.
+ You have to maintain 2 CSS styles for both...
+ Maintaining 2 more styles for one element can easily leads to style conflicts(priority conflicts)

In a word, it's bad design, hard to make changes. We should change the way we organize CSS files to make it more easily to maintain and make changes. Try to maintain one CSS file for both desktop and mobile, this saves much work and reduce the chances of style conflicts. That's the right design. Sex! I'm not talking keep just one file for all styles on all pages, you should have different CSS files for different modules, like you'll have `posts.css` for posts related pages, `books.css` for books related pages. So, go back to topic, what's the good practical organization of CSS files? One CSS file for both, let's see this example

  - app/
    - global_vars.css.less
    - posts.css.less
    - editors.css.less
    - books.css.less
  - application.css

And in `global_vars.css.less` file, we define some breakpoints/variables, like
``` css
  @desktop: ~"only screen and (min-width: 768px)";
  @tablet: ~"only screen and (max-width: 767px) and (min-width: 481px)";
  @tabletAndMobile: ~"only screen and (max-width: 767px)";
  @mobile: ~"only screen and (max-width: 480px) and (min-width: 415px)";
  @mobileAndBelow: ~"only screen and (max-width: 480px)";
  @mobileTall: ~"only screen and (max-width: 414px)";
```

What we did above is define some breakpoints of screen size of each kind of device. Then, say, in `posts.css.less` file,
``` css
  .title {
    font-size: 30px;
    text-decoration: underline;
    color: #333;
    
    @media @tablet {
    	font-size: 24px;
      text-decoration: none;
      color: #666;
    }
    
    @media @mobile {
    	font-size: 16px;
      text-decoration: none;
      color: #000;
    }
    
    ... /* you can define as many as you want styles here for different devices */
  }
```
For now, you already know what I mean of the good design of organization of CSS files. Try to put different styles for different breakpoint within one CSS selector. The advantages of doing this:

+ Maintain less files
+ Maintain less code
+ Less style conflicts(priority conflicts)

Less code means less errors XD

If you have many CSS files in your project and suffering from maitaining these files and suffering from style conflicts, try to do it with the new way this article introduced.
