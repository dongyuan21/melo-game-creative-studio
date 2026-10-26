export interface MeloErrorGuide {
  zh: string;
  hint: string;
  retry?: string;
}

export declare function mapErrorToZh(code: string | undefined): MeloErrorGuide | null;
