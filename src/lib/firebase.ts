import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCQtdPfqB5N9FJJ2f_fIox8xizEWh7ycKE',
  authDomain: 'masterboard-d85a1.firebaseapp.com',
  projectId: 'masterboard-d85a1',
  storageBucket: 'masterboard-d85a1.firebasestorage.app',
  messagingSenderId: '46502208844',
  appId: '1:46502208844:web:e955a9e33db9651ab79be9',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
