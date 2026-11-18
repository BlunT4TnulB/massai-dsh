package com.massai.app

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }
        webView.webViewClient = WebViewClient()
        webView.loadUrl(BuildConfig.MASSACOT_URL)
        setContentView(webView)
    }

    override fun onBackPressed() {
        // Let the WebView handle back navigation when possible.
        super.onBackPressed()
    }
}
