package in.cwpdetailers.staff;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeLocationBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
