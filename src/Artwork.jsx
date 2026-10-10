import React from 'react';

// These images enrich the atmosphere; all meaning and actions stay in real text.
export function Artwork({name, className = '', sizes = '160px', eager = false}) {
  return <picture className={`artwork ${className}`} aria-hidden="true">
    <source type="image/webp" srcSet={`/artwork/${name}-320.webp 320w, /artwork/${name}-640.webp 640w`} sizes={sizes}/>
    <img src={`/artwork/${name}-640.png`} width="640" height="640" alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority="low" draggable="false"/>
  </picture>;
}
