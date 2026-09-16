package com.menteagil.offline;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ProfilePhotoBridge {
    static final int REQUEST = 501;
    private final Activity activity;
    private final WebView view;
    private final SecureDataBridge store;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private String owner="";
    ProfilePhotoBridge(Activity activity,WebView view,SecureDataBridge store){this.activity=activity;this.view=view;this.store=store;}
    @JavascriptInterface public void choose() {
        activity.runOnUiThread(() -> {
            owner=store.accountId();
            Intent intent=new Intent(Build.VERSION.SDK_INT>=33?MediaStore.ACTION_PICK_IMAGES:Intent.ACTION_OPEN_DOCUMENT);
            intent.setType("image/*");
            if(Build.VERSION.SDK_INT<33) intent.addCategory(Intent.CATEGORY_OPENABLE);
            try { activity.startActivityForResult(intent,REQUEST); }
            catch(Exception ignored){notifyResult(false);}
        });
    }
    void result(int resultCode, Intent data) {
        if(resultCode!=Activity.RESULT_OK || data==null || data.getData()==null) return;
        Uri uri=data.getData(); final String photoOwner=owner;
        executor.execute(() -> {
            try {
                ByteArrayOutputStream output=new ByteArrayOutputStream();
                try(InputStream input=activity.getContentResolver().openInputStream(uri)) {
                    if(input==null) throw new IllegalStateException();
                    byte[] block=new byte[8192];int n;
                    while((n=input.read(block))!=-1){if(output.size()+n>12*1024*1024)throw new IllegalStateException();output.write(block,0,n);}
                }
                byte[] bytes=output.toByteArray();
                BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;
                BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
                if(options.outWidth<=0 || options.outHeight<=0)throw new IllegalStateException();
                options.inSampleSize=1;
                while(Math.max(options.outWidth,options.outHeight)/options.inSampleSize>1024)options.inSampleSize*=2;
                options.inJustDecodeBounds=false;
                Bitmap decoded=BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
                if(decoded==null)throw new IllegalStateException();
                Matrix transform=new Matrix();
                try {
                    int orientation=new ExifInterface(new ByteArrayInputStream(bytes)).getAttributeInt(ExifInterface.TAG_ORIENTATION,1);
                    if(orientation==2)transform.setScale(-1,1);
                    if(orientation==3)transform.setRotate(180);
                    if(orientation==4)transform.setScale(1,-1);
                    if(orientation==5){transform.setRotate(90);transform.postScale(-1,1);}
                    if(orientation==6)transform.setRotate(90);
                    if(orientation==7){transform.setRotate(-90);transform.postScale(-1,1);}
                    if(orientation==8)transform.setRotate(-90);
                }catch(Exception ignored){}
                Bitmap rotated=Bitmap.createBitmap(decoded,0,0,decoded.getWidth(),decoded.getHeight(),transform,true);
                int side=Math.min(rotated.getWidth(),rotated.getHeight());
                Bitmap cropped=Bitmap.createBitmap(rotated,(rotated.getWidth()-side)/2,(rotated.getHeight()-side)/2,side,side);
                Bitmap small=Bitmap.createScaledBitmap(cropped,384,384,true);
                ByteArrayOutputStream jpeg=new ByteArrayOutputStream();small.compress(Bitmap.CompressFormat.JPEG,82,jpeg);
                // Re-encoding drops EXIF/GPS metadata. Only the chosen photo is read.
                String value="data:image/jpeg;base64,"+Base64.encodeToString(jpeg.toByteArray(),Base64.NO_WRAP);
                boolean saved=store.saveValue("photo_"+(photoOwner.isEmpty()?"guest":photoOwner),value);
                java.util.Set<Bitmap> images=new java.util.HashSet<>(java.util.Arrays.asList(decoded,rotated,cropped,small));
                for(Bitmap bitmap:images)bitmap.recycle();
                notifyResult(saved);
            } catch(Exception | OutOfMemoryError ignored){notifyResult(false);}
        });
    }
    private void notifyResult(boolean saved){view.post(()->view.evaluateJavascript("window.MenteAccount&&window.MenteAccount.photoChanged("+saved+")",null));}
    void close(){executor.shutdownNow();}
}
