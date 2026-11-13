package com.z0rug1.spire;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Spire for Android: the web game from this repository, shown fullscreen in a WebView. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        drawUnderCutout(w);

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(10, 13, 12));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // the game saves progress in localStorage
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);                              // ignore the system font-size setting
        web.setWebViewClient(new WebViewClient());       // keep everything inside the app
        setContentView(web);

        if (saved == null) web.loadUrl("file:///android_asset/index.html");
        else web.restoreState(saved);
        immersive();
    }

    /** Use the area beside a notch or camera hole (Android 9 and later). */
    private static void drawUnderCutout(Window w) {
        if (Build.VERSION.SDK_INT < 28) return;
        try {
            WindowManager.LayoutParams lp = w.getAttributes();
            WindowManager.LayoutParams.class.getField("layoutInDisplayCutoutMode").setInt(lp, 1);   // SHORT_EDGES
            w.setAttributes(lp);
        } catch (Exception ignored) { }
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();          // the page sees itself hidden, pauses the climb and saves
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        immersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    /** Back pauses or resumes the climb; on the title screen it leaves the app. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(function(){try{return Spire.dev.state().mode}catch(e){return 'title'}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String mode) {
                        if (mode == null || mode.contains("title")) { finish(); return; }
                        web.evaluateJavascript(
                                "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", null);
                    }
                });
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
