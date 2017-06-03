---
layout: post
title: 'After you click the button'
date: 2013-02-28 16:41
comments: true
categories: ux
---

We browsers too many pages a day,click too many buttons.For many buttons,like **like**,**hate** button which are asynchronous or ajax behavior.

Well,in most web sites,while people click these button,request wont respond immediately,it needs time even short.So it looks no change with the button.

Then,problem comes,people could think that they didnt click the button correctly,then,click again.if still no change,click again till changes.This may drive the engineers crazy,but people dont know how this button works actually.People wont think like a engineer,what they know is to keep clicking till that button changes.

There's a way to work this out.To add a after-click tip.eg.**please wait...** or something else and disable the button to notice people just wait.

#### Lets see some images.

1. Before click 

	![before click](http://hlcfan.github.io/images/2013_02_28/img1.png)
2. After click,button is disable and shows **please wait...** 

	![after click](http://hlcfan.github.io/images/2013_02_28/img2.png)
3. After server responde,get the button reverted 

	![after responde](http://hlcfan.github.io/images/2013_02_28/img3.png)
