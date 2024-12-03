import { Button, notify } from '@affine/component';
import { AuthInput, ModalHeader } from '@affine/component/auth-components';
import { OAuth } from '@affine/core/components/affine/auth/oauth';
import { useAsyncCallback } from '@affine/core/components/hooks/affine-async-hooks';
import { AuthService, ServerService } from '@affine/core/modules/cloud';
import { ServerDeploymentType } from '@affine/graphql';
import { Trans, useI18n } from '@affine/i18n';
import { ArrowRightBigIcon, PublishIcon } from '@blocksuite/icons/rc';
import {
  FeatureFlagService,
  useLiveData,
  useService,
} from '@toeverything/infra';
import { cssVar } from '@toeverything/theme';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react';

import type { SignInState } from '.';
import * as style from './style.css';

const emailRegex =
  /^(?:(?:[^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@(?:(?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|((?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

function validateEmail(email: string) {
  return emailRegex.test(email);
}

export const SignInStep = ({
  state,
  changeState,
  close,
}: {
  state: SignInState;
  changeState: Dispatch<SetStateAction<SignInState>>;
  close: () => void;
}) => {
  const t = useI18n();
  const serverService = useService(ServerService);
  const serverName = useLiveData(
    serverService.server.config$.selector(c => c.serverName)
  );
  const isSelfhosted = useLiveData(
    serverService.server.config$.selector(
      c => c.type === ServerDeploymentType.Selfhosted
    )
  );
  const authService = useService(AuthService);
  const featureFlagService = useService(FeatureFlagService);
  const enableMultipleCloudServers = useLiveData(
    featureFlagService.flags.enable_multiple_cloud_servers.$
  );
  const [isMutating, setIsMutating] = useState(false);

  const [email, setEmail] = useState('');

  const [isValidEmail, setIsValidEmail] = useState(true);

  const loginStatus = useLiveData(authService.session.status$);

  useEffect(() => {
    if (loginStatus === 'authenticated') {
      close();
      notify.success({
        title: t['com.affine.auth.toast.title.signed-in'](),
        message: t['com.affine.auth.toast.message.signed-in'](),
      });
    }
  }, [close, loginStatus, t]);

  const onContinue = useAsyncCallback(async () => {
    if (!validateEmail(email)) {
      setIsValidEmail(false);
      return;
    }

    setIsValidEmail(true);
    setIsMutating(true);

    try {
      const { hasPassword, registered, magicLink } =
        await authService.checkUserByEmail(email);

      if (registered) {
        // provider password sign-in if user has by default
        //  If with payment, onl support email sign in to avoid redirect to affine app
        if (hasPassword) {
          changeState(prev => ({
            ...prev,
            email,
            step: 'signInWithPassword',
          }));
        } else {
          if (magicLink) {
            changeState(prev => ({
              ...prev,
              email,
              step: 'signInWithEmail',
            }));
          } else {
            notify.error({
              title: 'Failed to send email. Please contact the administrator.',
            });
          }
        }
      } else {
        if (magicLink) {
          changeState(prev => ({
            ...prev,
            email,
            step: 'signInWithEmail',
          }));
        } else {
          notify.error({
            title: 'Failed to send email. Please contact the administrator.',
          });
        }
      }
    } catch (err) {
      console.error(err);

      // TODO(@eyhn): better error handling
      notify.error({
        title: 'Failed to send email. Please try again.',
      });
    }

    setIsMutating(false);
  }, [authService, changeState, email]);

  const onAddSelfhosted = useCallback(() => {
    changeState(prev => ({
      ...prev,
      step: 'addSelfhosted',
    }));
  }, [changeState]);

  return (
    <>
      <ModalHeader
        title={t['com.affine.auth.sign.in']()}
        subTitle={serverName}
      />

      <OAuth redirectUrl={state.redirectUrl} />

      <div className={style.authModalContent}>
        <AuthInput
          label={t['com.affine.settings.email']()}
          placeholder={t['com.affine.auth.sign.email.placeholder']()}
          onChange={setEmail}
          error={!isValidEmail}
          errorHint={
            isValidEmail ? '' : t['com.affine.auth.sign.email.error']()
          }
          onEnter={onContinue}
        />

        <Button
          style={{ width: '100%' }}
          size="extraLarge"
          data-testid="continue-login-button"
          block
          loading={isMutating}
          suffix={<ArrowRightBigIcon />}
          suffixStyle={{ width: 20, height: 20, color: cssVar('blue') }}
          onClick={onContinue}
        >
          {t['com.affine.auth.sign.email.continue']()}
        </Button>

        {!isSelfhosted && (
          <div className={style.authMessage}>
            {/*prettier-ignore*/}
            <Trans i18nKey="com.affine.auth.sign.message">
                By clicking &quot;Continue with Google/Email&quot; above, you acknowledge that
                you agree to AFFiNE&apos;s <a href="https://affine.pro/terms" target="_blank" rel="noreferrer">Terms of Conditions</a> and <a href="https://affine.pro/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </Trans>
          </div>
        )}

        <div className={style.skipDivider}>
          <div className={style.skipDividerLine} />
          <span className={style.skipDividerText}>or</span>
          <div className={style.skipDividerLine} />
        </div>
        <div className={style.skipSection}>
          {!isSelfhosted &&
            BUILD_CONFIG.isElectron &&
            enableMultipleCloudServers && (
              <Button
                variant="plain"
                className={style.addSelfhostedButton}
                prefix={
                  <PublishIcon className={style.addSelfhostedButtonPrefix} />
                }
                onClick={onAddSelfhosted}
              >
                {t['com.affine.auth.sign.add-selfhosted']()}
              </Button>
            )}
          <div className={style.skipText}>
            {t['com.affine.mobile.sign-in.skip.hint']()}
          </div>
          <Button
            variant="plain"
            onClick={() => close()}
            className={style.skipLink}
            suffix={<ArrowRightBigIcon className={style.skipLinkIcon} />}
          >
            {t['com.affine.mobile.sign-in.skip.link']()}
          </Button>
        </div>
      </div>
    </>
  );
};
