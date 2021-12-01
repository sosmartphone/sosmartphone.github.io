const CheckLoginAndRedirectIfNot = () =>{
    var credentials = localStorage.getItem('credentials');
    if(!credentials){
        window.location.href='/login?redirect='+window.location.href+'&errorMessage=Please Login';
    }

}

CheckLoginAndRedirectIfNot();