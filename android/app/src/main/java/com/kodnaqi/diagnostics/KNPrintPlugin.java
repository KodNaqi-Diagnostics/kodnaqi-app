package com.kodnaqi.diagnostics;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "KNPrint")
public class KNPrintPlugin extends Plugin {

    private WebView printView;

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html");
        final String jobName = call.getString("jobName", "KodNaqi");
        final int widthMm = call.getInt("widthMm", 0);
        final int heightMm = call.getInt("heightMm", 0);

        if (html == null || html.isEmpty()) {
            call.reject("invalid_data");
            return;
        }

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    final WebView wv = new WebView(getActivity());
                    printView = wv;
                    final boolean[] started = new boolean[] { false };
                    wv.setWebViewClient(new WebViewClient() {
                        @Override
                        public void onPageFinished(WebView view, String url) {
                            if (started[0]) return;
                            started[0] = true;
                            try {
                                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                                PrintAttributes.Builder b = new PrintAttributes.Builder();
                                if (widthMm > 0 && heightMm > 0) {
                                    int w = Math.round(widthMm / 25.4f * 1000f);
                                    int h = Math.round(heightMm / 25.4f * 1000f);
                                    b.setMediaSize(new PrintAttributes.MediaSize("kn_custom", "Custom", w, h));
                                    b.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                                } else {
                                    b.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                                    b.setMinMargins(new PrintAttributes.Margins(394, 394, 394, 394));
                                }
                                pm.print(jobName, adapter, b.build());
                                call.resolve();
                            } catch (Exception e) {
                                call.reject("print_failed: " + e.getMessage());
                            }
                        }
                    });
                    wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "UTF-8", null);
                } catch (Exception e) {
                    call.reject("print_failed: " + e.getMessage());
                }
            }
        });
    }
}
