---
layout: post
title: 'Rails upload file with jQuery'
date: 2013-09-26 10:43
comments: true
categories: tech
---
well i've read many articles about rails app upload file with jQuery,but that's too complex I think.So I start to do it my way.

First,we need a form
``` html
<div id="news-image-uploader" class="modal hide fade in" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="false">
  <div class="modal-header">
  	<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
    <h3>Upload</h3>
  </div>  	
	  <div class="modal-body">
			<div>
		  	<label for="news-image">File</label>
		    <input id="news-image" name="image" type="file">
		  </div>	  	 
	  </div>
	  <div class="modal-footer"> 
	    <button class="btn btn-primary pull-right" id="news-image-submit">Submit</button>
	  </div>
</div>
```
![upload form](https://github.com/hlcfan/image_set/raw/master/141585-rails-upload-file-with-jquery/1.png)
then, here comes the leading role,javascript
``` javascript
$('#news-image-submit').click(function(){
	var fd = new FormData();    
	fd.append( 'file', $('#news-image')[0].files[0]);
	$.ajax({ url: '/patt_to_upload',
	  type: 'POST',
	  processData: false,
 		contentType: false,
	  beforeSend: function(xhr) {xhr.setRequestHeader('X-CSRF-Token', $('meta[name="csrf-token"]').attr('content'))},
	  data: fd,
	  success: function(data) {
	  	if(data.success){
	  		$('#huodong-correct .alert').remove();
				$('#news-image-uploader .modal-body').prepend("<div class='alert alert-success'>Done</div>")
				$('#news-image-uploader .modal-body').prepend("<input style='width:80%;' class='img-ret'type='text' value='"+data.info+"'/>")
				$('.img-ret').select();										
			}else{
         $('#huodong-correct .alert').remove();
				$('#news-image-uploader .modal-body').prepend("<div class='alert alert-important'>"+data.err+"</div>")
			}
	  }
	});	
})
```
them, we're gonna deal with the data in Ruby
``` ruby
image = MiniMagick::Image.read params[:file].read
format = params[:file].original_filename.split('.')[1]
file_name = "#{Rails.root}/tmp.#{format}"
image.write file_name
```
![upload success](https://github.com/hlcfan/image_set/raw/master/141585-rails-upload-file-with-jquery/2.png)
Ok,these are the general steps,you could modify them.