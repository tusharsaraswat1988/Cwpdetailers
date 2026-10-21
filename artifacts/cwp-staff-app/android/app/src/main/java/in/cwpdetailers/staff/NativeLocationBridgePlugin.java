package in.cwpdetailers.staff;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.LocationSettingsResponse;
import com.google.android.gms.location.Priority;
import com.google.android.gms.location.SettingsClient;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(
    name = "NativeLocationBridge",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION },
            alias = "location"
        )
    }
)
public class NativeLocationBridgePlugin extends Plugin {

    private ActivityResultLauncher<IntentSenderRequest> resolutionLauncher;
    private PluginCall pendingEnableCall;

    @Override
    public void load() {
        super.load();
        resolutionLauncher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                if (pendingEnableCall == null) {
                    return;
                }
                boolean isEnabled = isDeviceLocationEnabled();
                JSObject ret = new JSObject();
                if (result.getResultCode() == Activity.RESULT_OK || isEnabled) {
                    ret.put("enabled", true);
                    ret.put("status", "resolved");
                } else {
                    ret.put("enabled", isEnabled);
                    ret.put("status", isEnabled ? "resolved" : "declined");
                }
                pendingEnableCall.resolve(ret);
                pendingEnableCall = null;
            }
        );
    }

    private boolean isDeviceLocationEnabled() {
        Context ctx = getContext();
        if (ctx == null) {
            return false;
        }
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) {
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return lm.isLocationEnabled();
        } else {
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                   lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        }
    }

    @PluginMethod
    public void isLocationEnabled(PluginCall call) {
        boolean enabled = isDeviceLocationEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);

        Context ctx = getContext();
        if (ctx != null) {
            LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
            if (lm != null) {
                ret.put("gpsEnabled", lm.isProviderEnabled(LocationManager.GPS_PROVIDER));
                ret.put("networkEnabled", lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
            }
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void checkLocationPermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context is unavailable");
            return;
        }
        boolean fine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("fine", fine);
        ret.put("coarse", coarse);

        if (fine || coarse) {
            ret.put("permission", "granted");
            ret.put("permanentlyDenied", false);
        } else {
            boolean shouldShow = ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), Manifest.permission.ACCESS_FINE_LOCATION);
            boolean hasRequested = ctx.getSharedPreferences("cwp_location_bridge_prefs", Context.MODE_PRIVATE)
                .getBoolean("has_requested_location_permission", false);
            ret.put("permission", "prompt");
            ret.put("shouldShowRationale", shouldShow);
            // Only permanently denied if it has been requested at least once and Android rationale returns false
            ret.put("permanentlyDenied", hasRequested && !shouldShow);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void requestLocationPermission(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context unavailable");
            return;
        }
        boolean fine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (fine || coarse) {
            JSObject ret = new JSObject();
            ret.put("permission", "granted");
            ret.put("fine", fine);
            ret.put("coarse", coarse);
            ret.put("permanentlyDenied", false);
            call.resolve(ret);
            return;
        }

        requestPermissionForAlias("location", call, "locationPermissionCallback");
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        Context ctx = getContext();
        if (ctx == null) {
            call.reject("Context unavailable");
            return;
        }
        boolean fine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("fine", fine);
        ret.put("coarse", coarse);

        if (fine || coarse) {
            ret.put("permission", "granted");
            ret.put("permanentlyDenied", false);
        } else {
            ctx.getSharedPreferences("cwp_location_bridge_prefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("has_requested_location_permission", true)
                .apply();
            boolean shouldShow = ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), Manifest.permission.ACCESS_FINE_LOCATION);
            ret.put("permission", "denied");
            ret.put("permanentlyDenied", !shouldShow);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void enableLocation(PluginCall call) {
        if (isDeviceLocationEnabled()) {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            ret.put("status", "already_enabled");
            call.resolve(ret);
            return;
        }

        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }

        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000)
            .setMinUpdateIntervalMillis(5000)
            .build();

        LocationSettingsRequest.Builder builder = new LocationSettingsRequest.Builder()
            .addLocationRequest(locationRequest)
            .setAlwaysShow(true);

        SettingsClient client = LocationServices.getSettingsClient(activity);
        Task<LocationSettingsResponse> task = client.checkLocationSettings(builder.build());

        task.addOnSuccessListener(activity, response -> {
            JSObject ret = new JSObject();
            ret.put("enabled", true);
            ret.put("status", "already_enabled");
            call.resolve(ret);
        });

        task.addOnFailureListener(activity, e -> {
            if (e instanceof ResolvableApiException) {
                try {
                    pendingEnableCall = call;
                    ResolvableApiException resolvable = (ResolvableApiException) e;
                    IntentSenderRequest request = new IntentSenderRequest.Builder(resolvable.getResolution()).build();
                    resolutionLauncher.launch(request);
                } catch (Exception ex) {
                    pendingEnableCall = null;
                    JSObject ret = new JSObject();
                    ret.put("enabled", false);
                    ret.put("status", "cannot_resolve");
                    ret.put("error", ex.getMessage());
                    call.resolve(ret);
                }
            } else {
                JSObject ret = new JSObject();
                ret.put("enabled", false);
                ret.put("status", "unresolvable");
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void openLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open location settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open app settings: " + e.getMessage());
        }
    }
}
