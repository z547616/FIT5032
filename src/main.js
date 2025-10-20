import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import { auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'

createApp(App).use(router).mount('#app')

let app
onAuthStateChanged(auth, () => {
  if (!app) {
    app = createApp(App)
    app.use(router).mount('#app')
  }
})
