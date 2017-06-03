---
layout: post
title: 'Object Serialization in Objective C'
date: 2014-03-14 02:12
comments: true
categories: tech
---
Yesterday, i need to store some offline data in Sqlite, so I convert json(actually it's NSDictionary) to NSString and stored in Sqlite.

at the first time, i just convert NSDictionary to NSString directly, like:
``` Objective-C
NSString *str = [NSString stringFromFormat: @"%@", json];
```
and then what i get seems correct: a string that looks like a NSDictionary.Subsequently, I put'em into DB.What made me annoyed is that when I get the data from DB(a string you know), this piece of string just cannot convert to a NSDictionary as i expected.Which means during the convertion from NSDictionary to NSString, we lost some format or some meta info.

I googled this and got this:
> Apple provides a Dictionary -> String method that has no inverse

which completely explain why we failed.

You need format so I give you format. I Give you: `NSPropertyListSerialization` (Sparticus! :D)

+ Convert NSDictionary to NSString
``` Objective-C
NSData *plist = [NSPropertyListSerialization
                 dataWithPropertyList:cache_dictionary // NSDictionary
                 format:NSPropertyListXMLFormat_v1_0
                 options:kNilOptions
                 error:NULL];

NSString *str = [[NSString alloc] initWithData:plist encoding:NSUTF8StringEncoding];
```

+ Convert NSString to NSDictionary
``` Objective-C
NSDictionary *article_map = 
						[NSPropertyListSerialization
             propertyListWithData:[article_map_content dataUsingEncoding:NSUTF8StringEncoding]
             options:kNilOptions
             format:NULL
             error:NULL];
```

There must be some one doubt that why couldnt we use `NSKeyedArchiver`(`NSKeyedUnarchiver`), ya absolutely it could do unless you wont store data into Sqlite.

+ Archive
``` Objective-C
Post *aPost = [Post alloc] initWith: postDic];
NSData *data = [NSKeyedArchiver archiveDataWithRootObject: aPost];
```

+ Unarchive
``` Objective-C
Post *aPost =  [NSKeyedUnarchiver unarchiveObjectWithData: data];
```

So what are the differences, lets make a conclusion:

+ NSPropertyListSerialization
	+ only for NSDictionary
  + could get data formated NSString
  + dont need to do NSCoding work
  
+ NSKeyedArchiver
	+ for Object
  + get data directly
  + need to do NSCoding
