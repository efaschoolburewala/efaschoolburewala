import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.efaschool.burewala',
  appName: 'EFA School Burewala',
  webDir: 'public',
  android: {
    path: 'android [EFA_School]'
  },
  server: {
    url: 'https://efaschoolburewala.onrender.com',
    cleartext: true,
    allowNavigation: [
      'efaschoolburewala.onrender.com',
      '*.onrender.com'
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1e293b",
      showSpinner: false,
      androidSpinnerStyle: "large",
      spinnerColor: "#f97316"
    }
  }
};

export default config;
