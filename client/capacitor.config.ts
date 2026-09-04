import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.efaschool.burewala',
  appName: 'EFA School Burewala',
  webDir: 'public',
  android: {
    path: 'android [EFA_School]'
  },
  server: {
    url: 'https://efaschoolburewala.vercel.app',
    cleartext: true,
    allowNavigation: [
      'efaschoolburewala.vercel.app',
      '*.vercel.app',
      'efaschoolburewala.falconswift.online',
      '*.falconswift.online'
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
