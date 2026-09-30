import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',
  timeout:30000,
  use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure'},
  webServer:{command:'python3 -m http.server 4173 -d dist',port:4173,reuseExistingServer:false},
  projects:[{name:'mobile-chromium',use:{...devices['Pixel 7']}}]
});
