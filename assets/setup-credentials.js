$.ajaxSetup({
    beforeSend: function(xhr, setting) {
        const credentials = localStorage.getItem('credentials');
        if(!credentials){
            window.location.href='/login?redirect='+window.location.href+'&errorMessage=Please Login';
            return

        }
        const decodedCreds = JSON.parse(credentials)
        const {username, password} = decodedCreds;
        if(!username || !password ){
            window.location.href='/login?redirect='+window.location.href+'&errorMessage=Please Login';
            return
        }

        
        xhr.setRequestHeader ("Authorization", "Basic " + btoa(username + ":" + password));
    }
  });
  