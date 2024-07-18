import { useConnector } from 'react-instantsearch';
import {
  ViewConnector,
  ViewConnectorParams,
  ViewWidgetDescription,
} from './types';
import { connectView } from './connector';

export function useView<T extends string>(
  widgetParams: ViewConnectorParams<T>
) {
  return useConnector<ViewConnectorParams<T>, ViewWidgetDescription<T>>(
    connectView as unknown as ViewConnector<T>,
    widgetParams
  );
}
