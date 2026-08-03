import { useEffect, useRef } from 'react';

const VLIBRAS_SCRIPT_SRC = 'https://vlibras.gov.br/app/vlibras-plugin.js';

/**
 * Widget oficial de tradução em Libras (vlibras.gov.br), padrão em sites .gov.br.
 * Carrega o script externo do governo federal uma única vez.
 */
export function VLibrasWidget() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = () => {
      if (window.VLibras) {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
      }
    };

    if (document.querySelector(`script[src="${VLIBRAS_SCRIPT_SRC}"]`)) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = VLIBRAS_SCRIPT_SRC;
    script.async = true;
    script.onload = init;
    document.body.appendChild(script);
  }, []);

  const accessProps = { vw: '', className: 'enabled' };
  const buttonProps = { 'vw-access-button': '', className: 'active' };
  const wrapperProps = { 'vw-plugin-wrapper': '' };

  return (
    <div {...accessProps}>
      <div {...buttonProps} />
      <div {...wrapperProps}>
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
}
