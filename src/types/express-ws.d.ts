declare module 'express-ws' {
  import { Application } from 'express';
  
  interface ExpressWsApplication extends Application {
    ws(route: string, ...middleware: any[]): void;
    getWss(): any;
  }
  
  interface ExpressWsInstance {
    app: ExpressWsApplication;
    getWss(): any;
  }
  
  function expressWs(app: Application): ExpressWsInstance;
  export = expressWs;
}
