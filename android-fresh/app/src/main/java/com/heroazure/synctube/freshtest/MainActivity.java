package com.heroazure.synctube.freshtest;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView message = new TextView(this);
        message.setText("SUCCESSFUL!\\n\\nThe Android app opened correctly.\\n\\nNo website was loaded.");
        message.setTextColor(Color.WHITE);
        message.setTextSize(22);
        message.setGravity(Gravity.CENTER);
        message.setPadding(32, 32, 32, 32);
        message.setBackgroundColor(Color.rgb(15, 15, 21));

        setContentView(message);
    }
}
