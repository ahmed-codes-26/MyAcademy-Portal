import { useEffect, useRef } from 'react';

export default function HomeFaq({ question, answer }) {
  const details = useRef(null);
  const animation = useRef(null);
  const targetOpen = useRef(false);
  useEffect(() => () => animation.current?.cancel(), []);

  function toggle(event) {
    const element = details.current;
    if (!element.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    const start = element.getBoundingClientRect().height;
    const next = animation.current ? !targetOpen.current : !element.open;
    targetOpen.current = next;
    animation.current?.cancel();
    element.open = true;
    const end = next ? element.getBoundingClientRect().height : element.querySelector('summary').getBoundingClientRect().height + 1;
    element.dataset.expanded = String(next);
    const current = element.animate({ height: [`${start}px`, `${end}px`] }, { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    animation.current = current;
    current.onfinish = () => {
      element.open = next;
      delete element.dataset.expanded;
      animation.current = null;
    };
  }

  return <details ref={details}><summary onClick={toggle}>{question}<span aria-hidden="true">+</span></summary><div className="faq-answer"><p>{answer}</p></div></details>;
}
