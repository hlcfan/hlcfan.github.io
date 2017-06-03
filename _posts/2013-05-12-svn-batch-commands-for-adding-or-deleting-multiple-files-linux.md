---
layout: post
title: 'SVN batch commands for adding or deleting multiple files (Linux)'
date: 2013-05-12 11:56
comments: true
categories: tech
---

### Deleting multiple missing files (ie. the ones with a “!” next to them):
`svn delete $( svn status | sed -e '/^!/!d' -e 's/^!//' )`
### Adding multiple new files (ie. the ones with a “?” next to them):
`svn add $( svn status | sed -e '/^?/!d' -e 's/^?//' )`

Original Article:http://www.gilluminate.com/2008/10/16/svn-batch-commands/