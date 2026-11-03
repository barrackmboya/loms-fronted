import { Toaster as Sonner } from 'sonner'

// App-wide toast host. Visual styling (left-accent pattern, 8px radius,
// 12px 16px padding, Plex typography, 4s progress bar) lives in index.css
// under "sonner toasts". Mount once in App.jsx; fire with `toast(...)`.

export function Toaster(props) {
  return (
    <Sonner
      position="center"
      richColors={false}
      closeButton
      visibleToasts={3}
      duration={4000}
      {...props}
    />
  )
}

export { toast } from 'sonner'
