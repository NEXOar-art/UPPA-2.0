import React from 'react';
import { Lottie } from 'lottie-react';
import { PROMO_SPARK_LOTTIE, LIVE_RADAR_LOTTIE } from '../../utils/lottieAnimations';

interface LottieMicroIconProps {
  variant: 'spark' | 'radar';
  className?: string;
  size?: number;
}

export const LottieMicroIcon: React.FC<LottieMicroIconProps> = ({
  variant,
  className = 'w-5 h-5',
  size,
}) => {
  const animationData = variant === 'spark' ? PROMO_SPARK_LOTTIE : LIVE_RADAR_LOTTIE;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 pointer-events-none ${size ? '' : className}`}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      <Lottie
        src={animationData}
        loop
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </span>
  );
};
