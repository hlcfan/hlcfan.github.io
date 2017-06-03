---
layout: post
title: 'Upload file to qiniu cloud in tinymce editor'
date: 2016-11-20 13:49
comments: true
categories: tech
---
### Idea
First, we're not writing some plugins, I've seen many solutions to add self-made plugin to do that. What we're gonna do is to hook into TinyMCE's callback by event emitter and trigger Plupload to upload file nicely and cleanly.

### HTML
We need a textarea and hidden input, which type is file to trigger.

``` html
<textarea class="tinymce" />
<input name="upload" type="file" id="upload" class="hidden" />
```

### Javascript

#### Source of EventEmitter

``` javascript
var EventEmitter = {
  _events: {},
  dispatch: function (event, data) {
    if (!this._events[event]) {
      return;
    }
    for (var i = 0; i < this._events[event].length; i++) {
      this._events[event][i](data);
    }
  },
  subscribe: function (event, callback) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(callback);
  }
};
```

#### Source of initializing Qiniu uploader

``` javascript
// Modify the configurations accordingly.
var initUploader = function() {
	Qiniu.uploader({
    runtimes: 'html5,html4',
    browse_button: 'upload',
    uptoken_url: '/path_to_get_token',
    domain: 'http://whatever.bkt.clouddn.com/',
    max_retries: 3,
    auto_start: true,
    init: {
      'FileUploaded': function(up, file, info) {
        var domain = up.getOption('domain');
        var res = jQuery.parseJSON(info);
        var sourceLink = domain + res.key;
        // Dispatch message if uploaded.
        EventEmitter.dispatch("uploaded", sourceLink);
      },
      'Error': function(up, err, errTip) {
      }
    }
  });
}
```

#### Source of initializing TinyMCE

``` javascript
// You may not need so many configurations as I do.
tinyMCE.init({
  selector: 'textarea.tinymce',
  selection_toolbar: "bold italic | quicklink h2 h3 blockquote",
  toolbar1: "insertfile undo redo | styleselect | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image",
  toolbar2: "print preview media | forecolor backcolor emoticons | codesample",
  image_advtab: true,
  plugins: "advlist autolink lists link image charmap print preview hr anchor pagebreak searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking save table contextmenu directionality emoticons template paste textcolor colorpicker textpattern imagetools codesample",
  language: "zh_CN",
  theme: "modern",
  file_picker_types: 'file image media',
  file_picker_callback: function(callback, value, meta) {
    // Subscribe event `uploaded`
    EventEmitter.subscribe("uploaded", callback);
    if (meta.filetype == 'image') {
      // Trigger click to activate Plupload
      $('#upload').trigger('click');
    }
  },
  init_instance_callback : function(editor) {
    // Initialize uploader once editor initialized
    // This is important, cuz uploader will listen on 
    // element `upload` via configuration `browse_button`
    initUploader();
  }
});

```

### Recap
I've come to this solution after a bit long time of exploring.