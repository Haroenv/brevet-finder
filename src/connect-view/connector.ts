import type { ViewConnector } from './types';
import type { InstantSearch } from 'instantsearch.js';

type AugmentedInstantSearch = InstantSearch & { _view: string };

export const connectView: ViewConnector<string> = function connectView(
  renderFn,
  unmountFn = () => {}
) {
  return (widgetParams) => {
    const { defaultView } = widgetParams;

    let instance: AugmentedInstantSearch | undefined;

    return {
      $$type: 'haroen.view',
      init(initOptions) {
        const { instantSearchInstance } = initOptions;

        instance = instantSearchInstance as AugmentedInstantSearch;

        instance._view =
          // @ts-expect-error UiState in initOptions doesn't use generic
          initOptions.uiState[initOptions.parent.getIndexId()].view ||
          defaultView;

        renderFn(
          {
            ...this.getWidgetRenderState(initOptions),
            instantSearchInstance,
          },
          true
        );
      },
      render(renderOptions) {
        const { instantSearchInstance } = renderOptions;

        renderFn(
          {
            ...this.getWidgetRenderState(renderOptions),
            instantSearchInstance,
          },
          false
        );
      },
      dispose() {
        unmountFn();
      },
      getWidgetUiState(uiState) {
        if (!instance) {
          throw new Error('The connector has not been initialized');
        }
        return {
          ...uiState,
          view: instance._view,
        };
      },
      getWidgetSearchParameters(searchParameters) {
        return searchParameters;
      },
      getRenderState(renderState, renderOptions) {
        return {
          ...renderState,
          view: this.getWidgetRenderState(renderOptions),
        };
      },
      getWidgetRenderState(renderOptions) {
        if (!instance) {
          instance =
            renderOptions.instantSearchInstance as AugmentedInstantSearch;
        }

        return {
          view: instance._view || defaultView,
          refine: (newView) => {
            instance!._view = newView;
            instance?.setUiState((state) =>
              Object.fromEntries(
                Object.entries(state).map(([indexId, indexState]) => {
                  return [indexId, { ...indexState, view: instance!._view }];
                })
              )
            );
          },
          widgetParams,
        };
      },
    };
  };
};
