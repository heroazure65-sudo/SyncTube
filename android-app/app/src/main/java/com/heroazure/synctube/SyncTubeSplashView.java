package com.heroazure.synctube;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;
import android.view.animation.DecelerateInterpolator;

final class SyncTubeSplashView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float progress;

    SyncTubeSplashView(Context context) {
        super(context);
        setBackgroundColor(Color.rgb(11, 11, 18));
        ValueAnimator animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(1550L);
        animator.setInterpolator(new DecelerateInterpolator());
        animator.addUpdateListener(a -> { progress = (float) a.getAnimatedValue(); invalidate(); });
        animator.start();
    }

    private float dp(float v) { return v * getResources().getDisplayMetrics().density; }

    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w=getWidth(), h=getHeight(), cx=w*.5f, cy=h*.405f;
        canvas.drawColor(Color.rgb(11,11,18));
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx-dp(82),cy-dp(30),dp(245),new int[]{0x443F2A86,0x003F2A86},null,Shader.TileMode.CLAMP));
        canvas.drawCircle(cx-dp(82),cy-dp(30),dp(245),paint);
        paint.setShader(new RadialGradient(cx+dp(92),cy+dp(38),dp(230),new int[]{0x3322D3EE,0x0022D3EE},null,Shader.TileMode.CLAMP));
        canvas.drawCircle(cx+dp(92),cy+dp(38),dp(230),paint);
        paint.setShader(null);
        float radius=dp(91);
        Shader orbit=new android.graphics.SweepGradient(cx,cy,new int[]{0x008B5CF6,0xFF8B5CF6,0xFF22D3EE,0xFF8B5CF6,0x008B5CF6},null);
        android.graphics.Matrix matrix=new android.graphics.Matrix();
        matrix.setRotate(progress*300f,cx,cy); orbit.setLocalMatrix(matrix);
        paint.setShader(orbit); paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(dp(4.5f)); paint.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawCircle(cx,cy,radius,paint); paint.setShader(null); paint.setStyle(Paint.Style.FILL);
        for(int i=0;i<18;i++){
            double a=Math.PI*2*i/18.0+progress*Math.PI*1.7;
            float wobble=(float)Math.sin(progress*9+i*.8)*dp(4), r=radius+dp(15)+wobble;
            paint.setColor(i%2==0?0xFF8B5CF6:0xFF22D3EE); paint.setAlpha(55+(i*9)%175);
            canvas.drawCircle(cx+(float)Math.cos(a)*r,cy+(float)Math.sin(a)*r,dp(i%3==0?2.7f:1.7f),paint);
        }
        paint.setAlpha(255); paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(Typeface.create("sans-serif",Typeface.BOLD)); paint.setTextSize(dp(34));
        float ta=Math.max(0,Math.min(1,(progress-.22f)/.48f));
        paint.setColor(Color.argb((int)(255*ta),248,248,255)); canvas.drawText("SyncTube",cx,cy+dp(132),paint);
        paint.setTypeface(Typeface.create("sans-serif-medium",Typeface.NORMAL)); paint.setTextSize(dp(10));
        paint.setColor(Color.argb((int)(210*ta),171,174,194)); canvas.drawText("WATCH TOGETHER",cx,cy+dp(157),paint);
        float da=Math.max(0,Math.min(1,(progress-.45f)/.3f));
        for(int i=0;i<3;i++){ paint.setColor(i==1?0xFF22D3EE:0xFF8B5CF6); paint.setAlpha((int)(220*da)); canvas.drawCircle(cx+dp((i-1)*13),h*.82f,dp(i==1?3f:2.2f),paint); }
        paint.setAlpha(255);
    }
}
