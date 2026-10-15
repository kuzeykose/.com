import { register } from 'node:module'

register(new URL('./ts-resolve.mjs', import.meta.url))
