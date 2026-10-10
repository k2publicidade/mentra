import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e',testMatch:'online-auth.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:3101',headless:true},webServer:{command:'node server/index.js',url:'http://127.0.0.1:3101/api/health',reuseExistingServer:false,env:{PORT:'3101',DB_PATH:':memory:',NODE_ENV:'test'}}});
