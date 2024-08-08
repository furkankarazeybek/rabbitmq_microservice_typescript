interface RouteConfig {
    actionName: string;
    serviceName: string;
  }
  
  const routeConfig: RouteConfig[] = [
    { actionName: 'getUserList', serviceName: 'user' },
    { actionName: 'getRoleList', serviceName: 'user' },
    { actionName: 'getProductList', serviceName: 'product' },
  ];
  
  export default routeConfig;
  