package ca.massai.assist;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.ArrayList;
import java.util.Locale;

/**
 * The assist surface: what opens when the assistant button is held.
 *
 * It is a single WebView pointed at the same /ask page everyone uses, plus three native
 * pieces the web cannot do on Android: a speech recogniser for the question, a voice for
 * the answer, and the action that made the app the assist handler at all.
 */
public class MainActivity extends Activity {
  private static final String HOME = "https://massai-itu.ca/assist?assist=1";
  private static final int MIC = 41;

  private WebView web;
  private SpeechRecognizer recognizer;
  private TextToSpeech voice;
  private boolean listening;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    web = new WebView(this);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    web.setBackgroundColor(0xFF0B0A09);
    web.setWebViewClient(new WebViewClient());
    web.addJavascriptInterface(new Host(), "MassaiHost");
    setContentView(web);

    voice = new TextToSpeech(this, status -> {
      if (status == TextToSpeech.SUCCESS) voice.setLanguage(Locale.getDefault());
    });
    recognizer = SpeechRecognizer.createSpeechRecognizer(this);
    recognizer.setRecognitionListener(new Listener());

    web.loadUrl(HOME);
    listen();
  }

  /** Ask the system for one sentence. No wake word, no listening in the background. */
  private void listen() {
    if (listening) return;
    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC);
      return;
    }
    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
    listening = true;
    recognizer.startListening(intent);
  }

  @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(code, permissions, results);
    if (code == MIC && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) listen();
  }

  @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
    // The side button pressed again while open: another question.
    if (keyCode == KeyEvent.KEYCODE_HEADSETHOOK || keyCode == KeyEvent.KEYCODE_SEARCH) {
      listen();
      return true;
    }
    return super.onKeyDown(keyCode, event);
  }

  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    // The assist gesture fires again: ask again rather than reopen.
    listen();
  }

  @Override protected void onDestroy() {
    if (recognizer != null) recognizer.destroy();
    if (voice != null) { voice.stop(); voice.shutdown(); }
    if (web != null) web.destroy();
    super.onDestroy();
  }

  /** The bridge the page reads: the answer comes back here to be spoken. */
  private final class Host {
    @JavascriptInterface public void speak(String text) {
      if (text == null || text.isEmpty()) return;
      runOnUiThread(() -> voice.speak(text, TextToSpeech.QUEUE_FLUSH, null, "massai-answer"));
    }
  }

  /** One shot: hear a sentence, hand it to the page, let the page do the rest. */
  private final class Listener implements RecognitionListener {
    @Override public void onResults(Bundle results) {
      listening = false;
      ArrayList<String> heard = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
      if (heard == null || heard.isEmpty()) return;
      String question = heard.get(0).replace("'", "\\'");
      runOnUiThread(() -> web.evaluateJavascript("window.massai && window.massai.ask('" + question + "')", null));
    }
    @Override public void onError(int error) { listening = false; }
    @Override public void onReadyForSpeech(Bundle params) { }
    @Override public void onBeginningOfSpeech() { }
    @Override public void onRmsChanged(float rms) { }
    @Override public void onBufferReceived(byte[] buffer) { }
    @Override public void onEndOfSpeech() { }
    @Override public void onPartialResults(Bundle partial) { }
    @Override public void onEvent(int type, Bundle params) { }
  }
}
