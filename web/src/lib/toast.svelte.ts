type ToastType = 'success' | 'error' | 'info';

class ToastState {
  msg = $state('');
  type = $state<ToastType>('success');
  visible = $state(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(msg: string, type: ToastType = 'success', duration = 5000) {
    this.msg = msg;
    this.type = type;
    this.visible = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.visible = false), duration);
  }

  hide() {
    this.visible = false;
    clearTimeout(this.timer);
  }
}

export const toast = new ToastState();
